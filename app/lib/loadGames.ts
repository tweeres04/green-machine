import { readFile } from 'node:fs/promises'
import yaml from 'js-yaml'

export async function loadGames() {
	const fileContents = await readFile('./games.yml', 'utf8')

	const data = yaml.load(fileContents)

	return data
}
