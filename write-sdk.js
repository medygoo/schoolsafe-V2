const fs = require('fs');
const src = 'C:/Users/account/AppData/Local/Temp/supabase-sdk.js';
const dst = 'C:/Users/account/Videos/SchoolSafe V2/app/vendor/supabase-sdk.js';
try {
    const data = fs.readFileSync(src);
    fs.writeFileSync(dst, data);
    console.log('OK', fs.statSync(dst).size);
} catch (e) {
    console.error('ERR', e.message);
}
