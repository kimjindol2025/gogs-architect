import Parser from '../src/parser.js';

const testMarkdown = `# 제목 1
섹션 1 내용

## 제목 1-1
서브섹션 내용

# 제목 2
섹션 2 내용`;

const testFree = `def tokenize(text):
    tokens = []
    i = 0
    while i < len(text):
        tokens.append(text[i])
        i = i + 1
    return tokens

def main():
    print("hello")

main()`;

const testPython = `def hello():
    print("hello")

def world(name):
    return f"hello {name}"

class MyClass:
    def __init__(self):
        self.value = 42`;

const parser = new Parser();

console.log('=== Parser 테스트 ===\n');

// Test 1: Markdown
console.log('Test 1: Markdown 파싱');
const mdChunks = parser.parseFile('README.md', testMarkdown, { repo: 'test' });
console.log(`  ✓ 청크: ${mdChunks.length}개`);
mdChunks.forEach(c => console.log(`    - ${c.name} (${c.content.length}자)`));
console.log();

// Test 2: Free
console.log('Test 2: Free 파싱');
const freeChunks = parser.parseFile('test.free', testFree, { repo: 'test' });
console.log(`  ✓ 청크: ${freeChunks.length}개`);
freeChunks.forEach(c => console.log(`    - ${c.name} (라인 ${c.meta.lineStart}-${c.meta.lineEnd})`));
console.log();

// Test 3: Python
console.log('Test 3: Python 파싱');
const pyChunks = parser.parseFile('test.py', testPython, { repo: 'test' });
console.log(`  ✓ 청크: ${pyChunks.length}개`);
pyChunks.forEach(c => console.log(`    - ${c.name} (타입: ${c.type})`));
console.log();

console.log('=== 모든 테스트 완료 ✓ ===');
