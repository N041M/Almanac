// The desktop shell is a thin host: it loads the shared Vite/React renderer
// (the same build the web port serves) in the OS-native webview. All logic
// lives in the platform-agnostic core; nothing app-specific belongs here yet.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Almanac");
}
