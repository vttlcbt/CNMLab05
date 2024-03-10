const express = require("express")
const app = express()
const PORT = 3000
const multer = require("multer")
const AWS = require("aws-sdk")
require("dotenv").config()
const path = require("path")

//cau hinh multer
const storage = multer.memoryStorage({
  destination(req, file, callback) {
    callback(null, "")
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 2000000 }, // Chỉ cho phép file tối đa là 2MB
  fileFilter(req, file, cb) {
    checkFileType(file, cb)
  },
})
function checkFileType(file, cb) {
  const fileTypes = /jpeg|jpg|png|gif/

  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = fileTypes.test(file.mimetype)
  if (extname && mimetype) {
    return cb(null, true)
  }
  return cb("Error: Pls upload images /jpeg|jpg|png|gif/ only!")
}

// Cấu hình AWS
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = "1" // Kể từ 2023 v2 đã deprecated, ta chọn sử dụng aws-sdk javascript v2 thay vì v3
AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
})
const s3 = new AWS.S3()
const dynamodb = new AWS.DynamoDB.DocumentClient()
const tableName = process.env.DYNAMODB_TABLE_NAME
const bucketName = process.env.S3_BUCKET_NAME

//App
app.use(express.json({ extended: false }))
app.use(express.static("./views"))

app.set("view engine", "ejs")
app.set("views", "./views")

//Thay đổi data render trang index.ejs từ mảng thành data lấy từ cloud dymanodb
// App.get...
app.get("/", async (req, res) => {
  try {
    const params = { TableName: tableName }
    const data = await dynamodb.scan(params).promise()
    return res.render("index.ejs", { data: data.Items }) // Dùng biến response để render trang `index.ejs` đồng thời truyền biến `data`
  } catch (error) {
    console.error("Error retrieving data from DynamoDB:", error)
    return res.status(500).send("Internal Server Error")
  }
})

app.post("/save", upload.single("image"), (req, res) => {
  // Middleware uploadsingle('image) chỉnh định rằng field có name `image` trong request sẽ được xử lý (lọc, phân tích, kiểm tra dung lượng,..)
  try {
    const maSanPham = req.body.maSanPham // Lấy ra các tham số từ body của form
    const tenSanPham = req.body.tenSanPham // Lấy ra các tham số từ body của form
    const soLuong = Number(req.body.soLuong) // Lấy ra các tham số từ body của form

    const image = req.file.originalname.split(".")
    const fileType = image[image.length - 1]
    const filePath = `${maSanPham}_${Date.now().toString()}.${fileType}` // Custom name của image theo pattern

    const paramsS3 = {
      Bucket: bucketName,
      Key: filePath,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }
    s3.upload(paramsS3, async (err, data) => {
      // Upload img lên s3 trc
      if (err) {
        console.error("error=", err)
        return res.send("Internal server error!")
      } else {
        // Sau khi img upload -> sẽ gán URL cho image
        const imageURL = data.Location
        const paramsDynamoDb = {
          TableName: tableName,
          Item: {
            maSanPham,
            tenSanPham,
            soLuong,
            image: imageURL,
          },
        }
        await dynamodb.put(paramsDynamoDb).promise()
        return res.redirect("/") // Gọi render lại trang index (để cập nhật dữ liệu table)
      }
    })
  } catch (error) {
    console.error("Error saving data from DynamoDB:", error)
    return res.status(500).send("Internal Server Error")
  }
})

app.post("/delete", upload.fields([]), (req, res) => {
  const listCheckboxSelected = Object.keys(req.body) // Lấy ra tất cả checkboxes
  // req.body trả về 1 object chứa các cặp key & value định dạng:
  // '123456': 'on',
  // '123458': 'on',
  //listCheckboxSelected trả về 1 array: [ '123456', '123458', '96707133' ]
  if (!listCheckboxSelected || listCheckboxSelected.length <= 0) {
    return res.redirect("/")
  }
  try {
    function onDeleteItem(length) {
      // Định nghĩa hàm đệ quy xóa
      const params = {
        TableName: tableName,
        Key: {
          maSanPham: listCheckboxSelected[length],
        },
      }
      dynamodb.delete(params, (err, data) => {
        if (err) {
          console.error("error=", err)
          return res.send("Interal Server Error!")
        } else if (length > 0) {
          onDeleteItem(length - 1) // Nếu còn phần tử trong mảng thì gọi lại hàm đệ quy
        } else {
          return res.redirect("/") // Nếu không còn phần tử nào trong mảng thì render lại trang index
        }
      })
    }
    onDeleteItem(listCheckboxSelected.length - 1) // Gọi hàm đệ quy xóa
  } catch (error) {
    console.error("Error deleting data from DynamoDB:", error)
    return res.status(500).send("Internal Server Error")
  }
})

app.listen(PORT, () => {
  console.log(`Is running port http://localhost:${PORT}`)
})
