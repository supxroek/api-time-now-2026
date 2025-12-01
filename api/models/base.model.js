/**
 * /api/models/base.model.js
 *
 * Base Model Class สำหรับ MySQL2
 * ให้ความสามารถพื้นฐานในการ CRUD และ Query Builder
 */

const pool = require("../../config/database");

class BaseModel {
  /** -----------------------------------------------------------------------
   * @param {string} tableName - ชื่อตาราง
   * @param {string} primaryKey - Primary key field (default: 'id')
   * @param {Array<string>} hiddenFields - Fields ที่ไม่ต้องการ return
   * @param {Array<string>} fillable - Fields ที่อนุญาตให้ insert/update
   */
  constructor(tableName, primaryKey = "id", hiddenFields = [], fillable = []) {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.hiddenFields = hiddenFields;
    this.fillable = fillable;
    this.pool = pool;
  }

  /** -----------------------------------------------------------------------
   * ลบ hidden fields ออกจากผลลัพธ์
   * @param {Object|Array} data - ข้อมูลที่ต้องการซ่อน fields
   * @returns {Object|Array}
   */
  hideFields(data) {
    if (!data) return data;

    const hide = (obj) => {
      if (!obj) return obj;
      const result = { ...obj };
      this.hiddenFields.forEach((field) => delete result[field]);
      return result;
    };

    return Array.isArray(data) ? data.map(hide) : hide(data);
  }

  /** -----------------------------------------------------------------------
   * กรองเฉพาะ fillable fields
   * @param {Object} data - ข้อมูลที่ต้องการกรอง
   * @returns {Object}
   */
  filterFillable(data) {
    if (this.fillable.length === 0) return data;

    const result = {};
    this.fillable.forEach((field) => {
      if (data.hasOwnProperty(field)) {
        result[field] = data[field];
      }
    });
    return result;
  }

  /** -----------------------------------------------------------------------
   * Execute raw query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>}
   */
  async query(sql, params = []) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาข้อมูลทั้งหมด
   * @param {Object} options - { where, orderBy, limit, offset, select }
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    const {
      where = {},
      orderBy = null,
      limit = null,
      offset = null,
      select = "*",
    } = options;

    let sql = `SELECT ${select} FROM ${this.tableName}`;
    const params = [];

    // Build WHERE clause
    const whereKeys = Object.keys(where);
    if (whereKeys.length > 0) {
      const conditions = whereKeys.map((key) => {
        params.push(where[key]);
        return `${key} = ?`;
      });
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    // ORDER BY
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    // LIMIT & OFFSET
    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    const rows = await this.query(sql, params);
    return this.hideFields(rows);
  }

  /** -----------------------------------------------------------------------
   * ค้นหาข้อมูลด้วย Primary Key
   * @param {number|string} id - Primary key value
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ? LIMIT 1`;
    const rows = await this.query(sql, [id]);
    return rows.length > 0 ? this.hideFields(rows[0]) : null;
  }

  /** -----------------------------------------------------------------------
   * ค้นหาข้อมูลแถวเดียว
   * @param {Object} where - เงื่อนไขการค้นหา
   * @returns {Promise<Object|null>}
   */
  async findOne(where = {}) {
    const rows = await this.findAll({ where, limit: 1 });
    return rows.length > 0 ? rows[0] : null;
  }

  /** -----------------------------------------------------------------------
   * สร้างข้อมูลใหม่
   * @param {Object} data - ข้อมูลที่ต้องการสร้าง
   * @returns {Promise<Object>}
   */
  async create(data) {
    const filteredData = this.filterFillable(data);
    const keys = Object.keys(filteredData);
    const values = Object.values(filteredData);
    const placeholders = keys.map(() => "?").join(", ");

    const sql = `INSERT INTO ${this.tableName} (${keys.join(
      ", "
    )}) VALUES (${placeholders})`;
    const [result] = await this.pool.execute(sql, values);

    return {
      [this.primaryKey]: result.insertId,
      ...filteredData,
    };
  }

  /** -----------------------------------------------------------------------
   * อัพเดทข้อมูล
   * @param {number|string} id - Primary key value
   * @param {Object} data - ข้อมูลที่ต้องการอัพเดท
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    const filteredData = this.filterFillable(data);
    const keys = Object.keys(filteredData);
    const values = Object.values(filteredData);

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`;

    await this.pool.execute(sql, [...values, id]);
    return this.findById(id);
  }

  /** -----------------------------------------------------------------------
   * ลบข้อมูล
   * @param {number|string} id - Primary key value
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    const [result] = await this.pool.execute(sql, [id]);
    return result.affectedRows > 0;
  }

  /** -----------------------------------------------------------------------
   * นับจำนวนข้อมูล
   * @param {Object} where - เงื่อนไขการค้นหา
   * @returns {Promise<number>}
   */
  async count(where = {}) {
    let sql = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    const params = [];

    const whereKeys = Object.keys(where);
    if (whereKeys.length > 0) {
      const conditions = whereKeys.map((key) => {
        params.push(where[key]);
        return `${key} = ?`;
      });
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    const rows = await this.query(sql, params);
    return rows[0].total;
  }

  /** -----------------------------------------------------------------------
   * ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
   * @param {Object} where - เงื่อนไขการค้นหา
   * @returns {Promise<boolean>}
   */
  async exists(where) {
    const count = await this.count(where);
    return count > 0;
  }

  /** -----------------------------------------------------------------------
   * Transaction helper
   * @param {Function} callback - Function ที่จะทำใน transaction
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = BaseModel;
