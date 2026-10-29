fn main() {
    tauri_build::build();
    // MockRuntime exercises menu code too. Windows test executables need v6
    // Common Controls just like the native application; otherwise the loader
    // fails on TaskDialogIndirect before any test can run.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
        // tauri-build already embeds ID 1 for the app binary, including its
        // bin-test target. Keep that resource rather than generating it twice.
        println!("cargo:rustc-link-arg-bin=easyfab=/MANIFEST:NO");
    }
}
