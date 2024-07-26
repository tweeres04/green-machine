#!/bin/bash

BASE_DIR="public/photos/"

# Convert JPG and PNG to WebP
for file in ${BASE_DIR}*.{jpg,png}; do
  if [ -f "$file" ]; then
    convert "$file" "${file%.*}.webp"
  fi
done

# Delete original JPG and PNG files
rm ${BASE_DIR}*.jpg ${BASE_DIR}*.png

# Resize all WebP images to fit within 75x75 pixels
for file in ${BASE_DIR}*.webp; do
  convert "$file" -resize 75x75 "$file"
done

echo "Conversion, cleanup, and resizing complete!"