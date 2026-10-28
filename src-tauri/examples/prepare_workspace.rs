#[path = "../src/bootstrap.rs"]
mod bootstrap;
#[path = "../src/workspace.rs"]
#[allow(dead_code)]
mod workspace;
#[path = "../src/workspace_assets.rs"]
mod workspace_assets;
fn main() -> Result<(), String> {
    let root = std::env::args()
        .nth(1)
        .ok_or("Indica la carpeta compartida.")?;
    let default_local = std::path::PathBuf::from(
        std::env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA requerido.")?,
    )
    .join("EasyFAB");
    let local = std::env::args()
        .nth(2)
        .map(std::path::PathBuf::from)
        .unwrap_or(default_local);
    let info = workspace::initialize(std::path::Path::new(&root), &local)?;
    println!("Espacio preparado. ID: {}", info.id);
    Ok(())
}
