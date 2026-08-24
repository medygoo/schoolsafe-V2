src = r'C:\Users\account\AppData\Local\Temp\supabase-sdk.js'
dst = r'C:\Users\account\AppData\Local\Temp\supabase-sdk-split.txt'
with open(src, 'r', encoding='utf-8') as f:
    text = f.read()
with open(dst, 'w', encoding='utf-8') as f:
    for i in range(0, len(text), 1000):
        f.write(text[i:i+1000] + '\n')
print('lines', (len(text) + 999)//1000, 'len', len(text))
