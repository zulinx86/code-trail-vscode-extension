function callee() {
  return 1;
}

export function caller() {
  callee();
}
