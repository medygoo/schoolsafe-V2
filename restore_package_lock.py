import pathlib

src_dir = pathlib.Path('C:/Users/account')
dst = pathlib.Path('c:/Users/account/Videos/SchoolSafe V2/package-lock.json')

parts = [src_dir / f'plock{i}.txt' for i in range(1, 5)]
content = ''
for part in parts:
    content += part.read_text(encoding='utf-8')

dst.write_text(content, encoding='utf-8')
print(f'Written {dst} with {len(content.splitlines())} lines')
