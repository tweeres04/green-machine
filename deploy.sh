ssh server -T <<'EOL'
	cd green-machine && \
	git fetch && git reset --hard origin/main && \
	docker compose up --build -d
EOL