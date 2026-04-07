import fs from 'fs';
const content = fs.readFileSync('e:/Jarvisse Assistant 04 04 26/mon-ai-site/client/App.jsx', 'utf8');
let stack = [];
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
        if (char === '{' || char === '(' || char === '[') {
            stack.push({ char, line: i + 1 });
        } else if (char === '}' || char === ')' || char === ']') {
            let last = stack.pop();
            if (!last) {
                console.log(`ERREUR: Caractère fermant ${char} en trop à la ligne ${i + 1}`);
            } else if ((char === '}' && last.char !== '{') || (char === ')' && last.char !== '(') || (char === ']' && last.char !== '[')) {
                console.log(`ERREUR: Discordance à la ligne ${i + 1}. Attendu ${char}, mais ouvert avec ${last.char} à la ligne ${last.line}`);
            }
        }
    }
}
if (stack.length > 0) {
    stack.forEach(s => console.log(`ERREUR: Caractère ouvert ${s.char} non fermé à la ligne ${s.line}`));
} else {
    console.log("SYNTAXE_OK: Aucune discordance détectée.");
}
