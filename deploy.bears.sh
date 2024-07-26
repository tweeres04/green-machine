ssh server -T <<'EOL'
	cd green-machine && \
	git fetch && git reset --hard origin/main && \
	docker compose -f compose.bears.yml up --build -d
EOL