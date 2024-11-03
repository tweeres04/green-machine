import argon2 from 'argon2'

const password = process.argv[2]

if (!password) {
	console.error('Error: Pass in a password as the first argument')
	process.exit(1)
}

const hash = await argon2.hash(password)

console.log(hash)
