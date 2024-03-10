// after app.set - b4 app.listem

app.use('/', (req, resp) => {
    const courses = [
        {
            id: 1,
            name: 'Cơ sở dữ liệu',
            course_type: "Cơ sở",
            semester: "HK 20-22",
            department: "K.CNTT"
        },
        {
            id: 2,
            name: 'Cấu trúc dữ liệu',
            course_type: "Cơ sở",
            semester: "HK 20-22",
            department: "K.CNTT"
        },
        {
            id: 3,
            name: 'Công nghệ mới',
            course_type: "Chuyên ngành",
            semester: "HK 20-22",
            department: "K.CNTT"
        },
        {
            id: 4,
            name: 'Kiến trúc phần mềm',
            course_type: "Chuyên ngành",
            semester: "HK 20-22",
            department: "K.CNTT"
        }
    ]
    resp.render('index', {courses})
})