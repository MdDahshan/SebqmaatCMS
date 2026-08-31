use glob::Pattern;

fn main() {
    let patterns = vec!["**", "**/*", "/*", "/**/*", "/**"];
    for p in patterns {
        match Pattern::new(p) {
            Ok(pat) => println!("{} is valid", p),
            Err(e) => println!("{} is INVALID: {}", p, e),
        }
    }
}
