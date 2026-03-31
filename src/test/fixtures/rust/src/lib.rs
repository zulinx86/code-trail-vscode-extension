const MY_CONST: i32 = 1;

fn my_function() {}

fn my_outer_function() {
    fn my_inner_function() {
        let _ = 1;
    }
}

struct MyStruct {
    x: i32,
}

impl MyStruct {
    fn my_method(&self) -> i32 {
        self.x
    }
}

trait MyTrait {
    fn my_trait_method(&self) -> i32;
}

enum MyEnum {
    A,
    B,
}

fn my_callee() -> i32 {
    1
}

fn my_caller() -> i32 {
    my_callee()
}

struct MyImplCall {}

impl MyImplCall {
    fn my_impl_callee(&self) -> i32 {
        1
    }

    fn my_impl_caller(&self) -> i32 {
        self.my_impl_callee()
    }
}
