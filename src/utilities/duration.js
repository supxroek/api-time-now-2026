/**
 * Duration Utility Functions
 *
 * สำหรับจัดการเวลาในรูปแบบต่างๆ
 */

// Duration Class
class Duration {
  // แปลงระยะเวลาในรูปแบบ string เป็น milliseconds
  async parseDurationToMs(durationStr) {
    const regex = /(\d+)([smhd])/g;
    let match;
    let totalMs = 0;
    while ((match = regex.exec(durationStr)) !== null) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case "s":
          totalMs += value * 1000;
          break;
        case "m":
          totalMs += value * 60 * 1000;
          break;
        case "h":
          totalMs += value * 60 * 60 * 1000;
          break;
        case "d":
          totalMs += value * 24 * 60 * 60 * 1000;
          break;
      }
    }
    return totalMs;
  }
}

module.exports = new Duration();
