// Masque la console Windows dans les versions de production.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    boitier_lib::run()
}
