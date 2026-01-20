#!/bin/bash
# backup_db.sh

PREFIX=database-bak
DATE=$(date +%Y-%m-%d-%H%M)
FILENAME=$PREFIX-$DATE.tar.gz
tar czf $FILENAME database/*.db*
echo "✅ DB backup: $FILENAME"
ls -lh $PREFIX*.tar.gz | tail -1
