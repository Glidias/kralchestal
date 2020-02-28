function generateFileList (obj) {
	let newHash = {};
	for (let p in obj) {
		let refObj = typeof obj[p] !== "object" ? null : obj[p];
		let newObj = {
			assetId: refObj && refObj.assetId ? refObj.assetId : refObj === null ? obj[p] : null,
			path: refObj && refObj.path ? refObj.path : p,
		}
		if (newObj.assetId === null) throw new Error("Could not find asset id for:" + refObj);
		newHash[p] = newObj;
	}

	return newHash;
}

module.exports = {
	files: generateFileList({
		"main.build.js": 28354060,
        // "app.build.js": 28407713,
        "gen.build.js": 28539743
	})
}