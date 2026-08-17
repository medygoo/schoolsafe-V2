// SchoolSafe V2 — Module de production de cartes élèves dans le workspace
import { renderCardPreview, captureCardPng, ssClassType } from './card-renderer.js';

const state = {
  classes: [],
  students: [],
  selectedClass: null,
  selectedStudent: null,
  currentYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
  academicYearId: null,
  schoolInfo: null,
  apiBase: 'http://127.0.0.1:8787'
};

function $(id) { return document.getElementById(id); }

function setStatus(msg, type = 'ok') {
  const el = $('cardsStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error' ? '#c22f2f' : type === 'warning' ? '#b8860b' : '#08825a';
}

function getToken() {
  try {
    const session = JSON.parse(localStorage.getItem('schoolsafe-v2-session') || 'null');
    return session?.token || null;
  } catch { return null; }
}

function getSupabaseClient() {
  if (!window.SchoolSafeSupabaseSDK?.createClient) return null;
  const config = window.schoolSafeBackendConfig;
  if (!config?.supabase_url || !config?.supabase_anon_key) return null;
  return window.SchoolSafeSupabaseSDK.createClient(config.supabase_url, config.supabase_anon_key, {
    auth: { autoRefreshToken: true, persistSession: false }
  });
}

async function loadClasses() {
  const client = getSupabaseClient();
  if (!client) {
    setStatus('Supabase non disponible', 'error');
    return;
  }
  const { data, error } = await client
    .from('classes')
    .select('id, name, cycle_key, option, teacher_id, card_color, card_color_soft, card_color_dark, card_pat, card_family, card_variant, card_pat_style')
    .order('name');
  if (error) {
    setStatus('Erreur chargement classes : ' + error.message, 'error');
    return;
  }
  state.classes = data || [];
  const select = $('cardsClassSelect');
  select.innerHTML = '<option value="">Choisir une classe</option>';
  state.classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}

async function loadStudents(classId) {
  const client = getSupabaseClient();
  if (!client) return;
  const { data, error } = await client
    .from('students')
    .select('id, matricule, first_name, middle_name, last_name, date_of_birth, photo_path')
    .eq('class_id', classId)
    .order('last_name');
  if (error) {
    setStatus('Erreur chargement élèves : ' + error.message, 'error');
    return;
  }
  state.students = data || [];
  const select = $('cardsStudentSelect');
  select.innerHTML = '<option value="">Choisir un élève</option>';
  state.students.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.last_name} ${s.first_name} (${s.matricule})`;
    select.appendChild(opt);
  });
  select.disabled = false;
}

async function loadSchoolInfo() {
  const client = getSupabaseClient();
  if (!client) return;
  const { data, error } = await client.from('school').select('name, name_en, address, phone, email, motto, website, logo_path').maybeSingle();
  if (!error && data) {
    state.schoolInfo = {
      name: data.name,
      name_en: data.name_en,
      address: data.address,
      phone: data.phone,
      email: data.email,
      motto: data.motto,
      website: data.website
    };
  }
}

function adaptClassForRenderer(cls) {
  return {
    id: cls.id,
    name: cls.name,
    cycle: cls.cycle_key === 'nursery' ? 'maternelle' : cls.cycle_key === 'primary' ? 'primaire' : 'secondaire',
    option: cls.option || '',
    teacher_id: cls.teacher_id,
    card_color: cls.card_color,
    card_color_soft: cls.card_color_soft,
    card_color_dark: cls.card_color_dark,
    card_pat: cls.card_pat,
    card_family: cls.card_family,
    card_variant: cls.card_variant,
    card_pat_style: cls.card_pat_style
  };
}

function adaptStudentForRenderer(s, cls) {
  return {
    id: s.id,
    name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.trim(),
    mat: s.matricule,
    matricule: s.matricule,
    dob: s.date_of_birth,
    photo: s.photo_path,
    cid: cls.id,
    parent_name: null,
    parent_phone: null,
    authorized_name: null,
    authorized_phone: null
  };
}

async function renderPreview() {
  if (!state.selectedClass || !state.selectedStudent) return;
  const cls = adaptClassForRenderer(state.selectedClass);
  const student = adaptStudentForRenderer(state.selectedStudent, state.selectedClass);
  const patStyle = $('cardsPatStyle').value;
  const teacher = { id: state.selectedClass.teacher_id, name: '—' };
  const container = $('cardsPreview');
  try {
    renderCardPreview(container, student, cls, teacher, state.currentYear, state.schoolInfo, state.schoolInfo?.logo_path, patStyle);
    setStatus('Aperçu généré. Vérifiez la carte avant de demander l\'impression.');
    $('cardsRequestPrintBtn').disabled = false;
  } catch (e) {
    setStatus('Erreur aperçu : ' + e.message, 'error');
  }
}

async function requestPrint() {
  const token = getToken();
  if (!token) {
    setStatus('Vous devez être connecté.', 'error');
    return;
  }
  const container = $('cardsPreview');
  const cls = adaptClassForRenderer(state.selectedClass);
  const { type } = ssClassType(cls);
  const wrapSelector = type === 'badge' ? '.ss-badge-wrap' : '.ss-carte-wrap';
  const wraps = container.querySelectorAll(wrapSelector + ' .art');
  if (wraps.length < 2) {
    setStatus('Aperçu incomplet. Régénérez la carte.', 'error');
    return;
  }
  setStatus('Capture des images en cours…', 'warning');
  try {
    const frontDataUrl = await captureCardPng(container, wrapSelector + ' .art:first-child');
    const backDataUrl = await captureCardPng(container, wrapSelector + ' .art:last-child');
    const payload = {
      student_id: state.selectedStudent.id,
      format: type,
      front_image_base64: frontDataUrl,
      back_image_base64: backDataUrl,
      academic_year_id: state.academicYearId,
      metadata: {
        class_name: state.selectedClass.name,
        requested_at: new Date().toISOString()
      }
    };
    setStatus('Envoi au VPS…', 'warning');
    const res = await fetch(state.apiBase + '/cards/request-print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || 'Erreur ' + res.status);
    }
    setStatus('Demande envoyée ✓ Référence : ' + (data?.data?.requestId || '—'));
  } catch (e) {
    setStatus('Erreur envoi : ' + e.message, 'error');
  }
}

export function initCardsModule(options) {
  if (options?.apiBase) state.apiBase = options.apiBase;
  if (window.schoolSafeBackendConfig) {
    state.apiBase = window.schoolSafeBackendConfig.api_base || state.apiBase;
  }
  if (document.getElementById('navCards')?._cardsBound) return;

  const navCards = $('navCards');
  const studio = $('cardsStudio');
  const closeBtn = $('closeCardsStudio');
  const classSelect = $('cardsClassSelect');
  const studentSelect = $('cardsStudentSelect');
  const renderBtn = $('cardsRenderBtn');
  const requestBtn = $('cardsRequestPrintBtn');

  if (!navCards || !studio || !closeBtn || !classSelect || !studentSelect || !renderBtn || !requestBtn) {
    console.warn('[cards-module] Éléments du studio non disponibles — init différée.');
    return;
  }

  navCards.addEventListener('click', () => {
    studio.hidden = false;
    const grid = document.querySelector('.workspace-grid');
    const protectedEl = document.getElementById('cardsProtected');
    if (grid) grid.style.display = 'none';
    if (protectedEl) protectedEl.style.display = 'none';
    loadClasses();
    loadSchoolInfo();
  });

  closeBtn.addEventListener('click', () => {
    studio.hidden = true;
    const grid = document.querySelector('.workspace-grid');
    const protectedEl = document.getElementById('cardsProtected');
    if (grid) grid.style.display = '';
    if (protectedEl) protectedEl.style.display = '';
  });

  classSelect.addEventListener('change', async (e) => {
    const classId = e.target.value;
    state.selectedClass = state.classes.find(c => c.id === classId) || null;
    state.selectedStudent = null;
    studentSelect.disabled = true;
    studentSelect.innerHTML = '<option value="">Choisir un élève</option>';
    renderBtn.disabled = true;
    requestBtn.disabled = true;
    $('cardsPreview').innerHTML = '<div style="text-align:center;padding:40px;color:#888;font-size:13px">Sélectionnez un élève.</div>';
    if (state.selectedClass) {
      await loadStudents(classId);
      renderBtn.disabled = false;
    }
  });

  studentSelect.addEventListener('change', (e) => {
    state.selectedStudent = state.students.find(s => s.id === e.target.value) || null;
    requestBtn.disabled = true;
  });

  renderBtn.addEventListener('click', renderPreview);
  requestBtn.addEventListener('click', requestPrint);
  navCards._cardsBound = true;
}

window.SchoolSafeCards = { init: initCardsModule };
