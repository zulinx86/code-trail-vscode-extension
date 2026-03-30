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
