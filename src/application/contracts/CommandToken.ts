// 用途：保存命令参数的文本与引用信息，避免将引号内的关键字误作语法。
export interface CommandToken {
  readonly value: string;
  readonly quoted: boolean;
}
