// 用途：复制并递归冻结纯描述数据，避免扩展通过查询结果影响文档或其他扩展。
export class ReadonlyData {
  static copy<T>(value: T): T {
    return ReadonlyData.freeze(structuredClone(value));
  }

  private static freeze<T>(value: T): T {
    if (value !== null && typeof value === "object") {
      for (const child of Object.values(value)) {
        ReadonlyData.freeze(child);
      }
      Object.freeze(value);
    }
    return value;
  }
}
