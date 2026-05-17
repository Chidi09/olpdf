export function shouldEditFabricTextInPlace(targetType: string | undefined) {
  return targetType === "textbox" || targetType === "i-text" || targetType === "text";
}
