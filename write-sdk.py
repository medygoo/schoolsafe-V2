import shutil
src = r'C:\Users\account\AppData\Local\Temp\supabase-sdk.js'
dst = r'C:\Users\account\Videos\SchoolSafe V2\app\vendor\supabase-sdk.js'
try:
    shutil.copy(src, dst)
    print('OK')
except Exception as e:
    print('ERR', e)
