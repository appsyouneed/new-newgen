#!/usr/bin/env python3
import os
import zipfile
import sys

def create_project_zip():
    base_dir = os.path.abspath(os.path.dirname(__file__))
    output_zip = os.path.join(base_dir, "public", "newgen-terminal-full-project.zip")
    os.makedirs(os.path.dirname(output_zip), exist_ok=True)
    
    # Exclude ephemeral/huge directories that should not be in zip
    exclude_dirs = {
        "node_modules",
        ".git",
        "__pycache__",
        ".pytest_cache",
        ".app-venv",
        ".cache",
        "tmp"
    }

    # Exclude zip files themselves
    exclude_extensions = {".zip", ".tar.gz", ".tgz"}

    total_files = 0
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(base_dir):
            # Exclude specified directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in exclude_extensions:
                    continue
                if f.startswith(".DS_Store"):
                    continue

                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, base_dir)

                # Skip anything in root that isn't part of project
                if rel_path.startswith(".."):
                    continue

                zf.write(full_path, rel_path)
                total_files += 1

    size_bytes = os.path.getsize(output_zip)
    size_mb = size_bytes / (1024 * 1024)
    print(f"ZIP created: {output_zip} ({size_mb:.2f} MB, {total_files} files)")
    
    # Also create symlink or copy to /public/project.zip for easy URL access
    alias_zip = os.path.join(base_dir, "public", "project.zip")
    if os.path.exists(alias_zip):
        os.remove(alias_zip)
    try:
        os.link(output_zip, alias_zip)
    except:
        import shutil
        shutil.copy2(output_zip, alias_zip)

if __name__ == "__main__":
    create_project_zip()
