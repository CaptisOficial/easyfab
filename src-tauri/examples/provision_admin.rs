//! Adaptador opcional de consola: la misma alta inicial que utiliza la app.
#[path = "../src/auth.rs"]
#[allow(dead_code, unused_imports)]
mod auth;
#[path = "../src/workspace.rs"]
#[allow(dead_code)]
mod workspace;
#[path = "../src/bootstrap.rs"]
mod bootstrap;
#[path = "../src/workspace_assets.rs"]
mod workspace_assets;
use std::{io, path::PathBuf};
fn ask(prompt: &str) -> Result<String, String> {
    eprintln!("{prompt}");
    let mut value = String::new();
    io::stdin()
        .read_line(&mut value)
        .map_err(|e| e.to_string())?;
    Ok(value.trim().to_string())
}
fn main() -> Result<(), String> {
    let data = PathBuf::from(std::env::args().nth(1).ok_or("Indica easy-fab/data.")?);
    let id = ask("Usuario EasyFAB del administrador:")?;
    let name = ask("Nombre completo:")?;
    let temporary = auth::provision_initial_admin(&data, id, name)?;
    eprintln!("Administrador creado. Temporal de 8 caracteres (24 horas): {temporary}");
    Ok(())
}
