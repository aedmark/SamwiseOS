// scripts/comm_utils.js

class PatchUtils {
    static createPatch(oldText, newText) {
        if (oldText === newText) {
            return null;
        }
        let start = 0;
        while (
            start < oldText.length &&
            start < newText.length &&
            oldText[start] === newText[start]
            ) {
            start++;
        }
        let oldEnd = oldText.length;
        let newEnd = newText.length;
        while (
            oldEnd > start &&
            newEnd > start &&
            oldText[oldEnd - 1] === newText[newEnd - 1]
            ) {
            oldEnd--;
            newEnd--;
        }
        const deletedText = oldText.substring(start, oldEnd);
        const insertedText = newText.substring(start, newEnd);
        return {
            index: start,
            delete: deletedText.length,
            insert: insertedText,
            deleted: deletedText,
        };
    }

    static applyPatch(originalContent, hunks) {
        if (!hunks || hunks.length === 0) {
            return originalContent;
        }

        const lines = originalContent.split('\n');
        let offset = 0;

        for (const hunk of hunks) {
            const insertLines = [];
            const removeLines = [];
            let contextLinesCount = 0;

            for(const line of hunk.lines){
                if(line.startsWith('+')){
                    insertLines.push(line.substring(1));
                } else if (line.startsWith('-')){
                    removeLines.push(line.substring(1));
                } else {
                    contextLinesCount++;
                }
            }

            const startIndex = hunk.oldStart - 1 + offset;
            const linesToRemove = lines.slice(startIndex, startIndex + removeLines.length + contextLinesCount);
            lines.splice(startIndex, removeLines.length);
            for (let i = 0; i < insertLines.length; i++) {
                lines.splice(startIndex + i, 0, insertLines[i]);
            }

            offset += (insertLines.length - removeLines.length);
        }

        return lines.join('\n');
    }

    static applyInverse(text, patch) {
        const head = text.substring(0, patch.index);
        const tail = text.substring(patch.index + patch.insert.length);
        return head + patch.deleted + tail;
    }
}