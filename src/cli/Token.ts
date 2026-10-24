/** 保留引号信息，避免把文字中的 "in" 当作容器子句。 */
export class Token {
  constructor(readonly value: string, readonly quoted = false) {}
}
