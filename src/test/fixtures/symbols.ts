const myConst = 1;

function myFunction() {}

function myOuterFunction() {
  function myInnerFunction() {
    return 1;
  }
}

class MyClass {
  myMethod() {
    return 1;
  }
}

interface MyInterface {
  x: number;
}

enum MyEnum {
  A,
  B,
}
