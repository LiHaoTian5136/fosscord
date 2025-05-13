/*
	Fosscord: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Fosscord and Fosscord Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import FormData from "form-data";
import { HTTPError } from "lambert-server";
import fetch from "node-fetch";
import { Attachment } from "../entities";
import { Config } from "./Config";
import fs from "fs/promises";
import path from "path";

export async function uploadFile(
	path: string,
	// These are the only props we use, don't need to enforce the full type.
	file?: Pick<Express.Multer.File, "mimetype" | "originalname" | "buffer">,
): Promise<Attachment> {
	if (!file?.buffer) throw new HTTPError("Missing file in body");

	const form = new FormData();
	form.append("file", file.buffer, {
		contentType: file.mimetype,
		filename: file.originalname,
	});

	const response = await fetch(
		`${Config.get().cdn.endpointPrivate || "http://localhost:3001"}${path}`,
		{
			headers: {
				signature: Config.get().security.requestSignature,
				...form.getHeaders(),
			},
			method: "POST",
			body: form,
		},
	);
	const result = (await response.json()) as Attachment;

	if (response.status !== 200) throw result;
	return result;
}

export async function handleFile(
	savePath: string,
	body?: string
): Promise<string | undefined> {
	if (!body || !body.startsWith("data:")) return undefined;

	try {
		const [header, base64] = body.split(",");
		const match = header.match(/^data:(image\/[a-zA-Z]+);base64$/);
		if (!match) throw new Error("Invalid MIME type");

		const mime = match[1];
		const ext = mime.split("/")[1]; // e.g., 'png', 'jpeg'
		const buffer = Buffer.from(base64, "base64");

		const fullPath = path.join("public", `${savePath}.${ext}`);
		await fs.mkdir(path.dirname(fullPath), { recursive: true });
		await fs.writeFile(fullPath, buffer);

		// Return the path to store in the database or return to client
		return `${savePath}.${ext}`;
	} catch (err) {
		console.error("handleFile error:", err);
		throw new HTTPError("Invalid " + savePath);
	}
}

export async function deleteFile(path: string) {
	const response = await fetch(
		`${Config.get().cdn.endpointPrivate || "http://localhost:3001"}${path}`,
		{
			headers: {
				signature: Config.get().security.requestSignature,
			},
			method: "DELETE",
		},
	);
	const result = await response.json();

	if (response.status !== 200) throw result;
	return result;
}
