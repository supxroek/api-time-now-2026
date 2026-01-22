// ฟังก์ชันสำหรับจับข้อผิดพลาดในฟังก์ชันแบบอะซิงโครนัส (Asynchronous Function Error Catcher)
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
module.exports = catchAsync;
