# Bash Example

```bash
#!/bin/bash

# Configuration
OUTPUT_DIR="/var/log/backup"
DATE=$(date +%Y-%m-%d)

# Function to backup
backup_files() {
    local src=$1
    local dest="$OUTPUT_DIR/$DATE"
    
    mkdir -p "$dest"
    
    if tar -czf "$dest/backup.tar.gz" "$src"; then
        echo "Backup successful: $dest"
        return 0
    else
        echo "Backup failed!" >&2
        return 1
    fi
}

# Main
for dir in /home/*; do
    [ -d "$dir" ] && backup_files "$dir"
done
```
