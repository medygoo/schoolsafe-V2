// SchoolSafe V2 — Module de production de cartes élèves dans le workspace
import { renderCardPreview, captureCardPng, ssClassType } from './card-renderer.js';

const state = {
  classes: [],
  students: [],
  guardians: new Map(),
  selectedClass: null,
  selectedStudentIds: new Set(),
  currentYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
  academicYearId: null,
  schoolInfo: null,
  apiBase: window.schoolSafeApiBase || window.SCHOOLSAFE_API_BASE || 'http://127.0.0.1:8787'
};

function $(id) { return document.getElementById(id); }

function setStatus(msg, type = 'ok') {
  const el = $('cardsStatus');
  if (!el) return;
  if (msg && typeof msg === 'object') {
    el.innerHTML = window.ssState(msg);
    el.style.color = '';
  } else {
    el.textContent = msg;
    el.style.color = type === 'error' ? '#c22f2f' : type === 'warning' ? '#b8860b' : '#08825a';
  }
}

function getToken() {
  try {
    const session = JSON.parse(sessionStorage.getItem('schoolsafe-v2-session') || 'null');
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
    setStatus({ type: 'error', title: 'Service indisponible', message: 'Supabase non disponible', size: 'inline' });
    return;
  }
  const { data, error } = await client
    .from('classes')
    .select('id, name, cycle_key, option, teacher_id, card_color, card_color_soft, card_color_dark, card_pat, card_family, card_variant, card_pat_style')
    .order('name');
  if (error) {
    setStatus({ type: 'error', title: 'Erreur de chargement', message: 'Erreur chargement classes : ' + error.message, size: 'inline' });
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
    .select('id, matricule, first_name, middle_name, last_name, date_of_birth, photo_path, card_print_count')
    .eq('lifecycle_status', 'active')
    .eq('class_id', classId)
    .order('last_name');
  if (error) {
    setStatus({ type: 'error', title: 'Erreur de chargement', message: 'Erreur chargement élèves : ' + error.message, size: 'inline' });
    return;
  }
  state.students = data || [];
  state.selectedStudentIds.clear();
  await loadGuardians(classId);
  renderStudentList();
  $('cardsRenderBtn').disabled = state.students.length === 0;
  $('cardsRequestPrintBtn').disabled = true;
  $('cardsPreview').innerHTML = window.ssState({ type: 'empty', title: 'Aucun aperçu', message: 'Sélectionnez un ou plusieurs élèves.', size: 'compact' });
}

async function loadGuardians(classId) {
  const client = getSupabaseClient();
  if (!client) return;
  const studentIds = state.students.map(s => s.id);
  if (studentIds.length === 0) {
    state.guardians.clear();
    return;
  }
  const { data, error } = await client
    .from('student_guardians')
    .select('student_id, guardian_type, is_primary, full_name, phone, is_authorized_pickup')
    .in('student_id', studentIds);
  if (error) {
    setStatus({ type: 'error', title: 'Erreur de chargement', message: 'Erreur chargement tuteurs : ' + error.message, size: 'inline' });
    return;
  }
  state.guardians.clear();
  (data || []).forEach(g => {
    if (!state.guardians.has(g.student_id)) state.guardians.set(g.student_id, []);
    state.guardians.get(g.student_id).push(g);
  });
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
    window.SCHOOL_LOGO = data.logo_path || '';
  }
}

function isCardInfoComplete(s) {
  if (!s.matricule || !s.first_name || !s.last_name || !s.date_of_birth || !s.photo_path) return false;
  const guards = state.guardians.get(s.id) || [];
  if (guards.length === 0) return false;
  return true;
}

function renderStudentList() {
  const list = $('cardsStudentList');
  list.innerHTML = '';
  if (state.students.length === 0) {
    list.innerHTML = window.ssState({ type: 'empty', title: 'Aucun élève', message: 'Aucun élève dans cette classe.', size: 'compact' });
    return;
  }
  state.students.forEach(s => {
    const complete = isCardInfoComplete(s);
    const label = document.createElement('label');
    label.title = complete ? 'Informations complètes' : 'Informations incomplètes';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = s.id;
    checkbox.checked = state.selectedStudentIds.has(s.id);
    checkbox.disabled = !complete;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedStudentIds.add(s.id);
      else state.selectedStudentIds.delete(s.id);
      updateSelectionState();
    });
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${s.last_name} ${s.first_name}`;
    const meta = document.createElement('span');
    meta.className = 'student-meta';
    meta.textContent = complete ? (s.card_print_count > 0 ? `v${s.card_print_count + 1}` : 'prêt') : 'incomplet';
    if (!complete) label.style.opacity = '0.6';
    label.appendChild(checkbox);
    label.appendChild(nameSpan);
    label.appendChild(meta);
    list.appendChild(label);
  });
  updateSelectionState();
}

function updateSelectionState() {
  const count = state.selectedStudentIds.size;
  const btn = $('cardsRequestPrintBtn');
  const renderBtn = $('cardsRenderBtn');
  btn.disabled = count === 0;
  renderBtn.disabled = count === 0;
  $('cardsSelectAll').checked = count > 0 && count === state.students.filter(s => isCardInfoComplete(s)).length;
  setStatus(count === 0 ? { type: 'empty', title: 'Aucune sélection', message: 'Sélectionnez un ou plusieurs élèves.', size: 'inline' } : `${count} élève(s) sélectionné(s).`);
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
  const guards = state.guardians.get(s.id) || [];
  const primary = guards.find(g => g.is_primary) || guards[0];
  const authorized = guards.find(g => g.is_authorized_pickup && g.full_name !== primary?.full_name) || primary;
  return {
    id: s.id,
    name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.trim(),
    mat: s.matricule,
    matricule: s.matricule,
    dob: s.date_of_birth,
    photo: s.photo_path,
    cid: cls.id,
    parent_name: primary?.full_name || null,
    parent_phone: primary?.phone || null,
    authorized_name: authorized?.full_name || null,
    authorized_phone: authorized?.phone || null
  };
}

async function renderPreviewForStudent(student) {
  if (!state.selectedClass || !student) return;
  const cls = adaptClassForRenderer(state.selectedClass);
  const adapted = adaptStudentForRenderer(student, state.selectedClass);
  const patStyle = $('cardsPatStyle').value;
  const teacher = { id: state.selectedClass.teacher_id, name: '—' };
  const container = $('cardsPreview');
  renderCardPreview(container, adapted, cls, teacher, state.currentYear, state.schoolInfo, state.schoolInfo?.logo_path, patStyle);
}

async function renderPreview() {
  if (!state.selectedClass) return;
  const selected = state.students.filter(s => state.selectedStudentIds.has(s.id));
  if (selected.length === 0) {
    setStatus({ type: 'error', title: 'Sélection requise', message: 'Sélectionnez au moins un élève.', size: 'inline' });
    return;
  }
  await renderPreviewForStudent(selected[0]);
  setStatus({ type: 'success', title: 'Aperçu prêt', message: `Aperçu de ${selected[0].first_name} ${selected[0].last_name}. ${selected.length > 1 ? `+ ${selected.length - 1} autre(s) sélectionné(s).` : ''}`, size: 'inline' });
}

async function generateCardPayload(student) {
  const cls = adaptClassForRenderer(state.selectedClass);
  const { type } = ssClassType(cls);
  const container = $('cardsPreview');
  const adapted = adaptStudentForRenderer(student, state.selectedClass);
  renderCardPreview(container, adapted, cls, { id: state.selectedClass.teacher_id, name: '—' }, state.currentYear, state.schoolInfo, state.schoolInfo?.logo_path, $('cardsPatStyle').value);
  await new Promise(r => setTimeout(r, 80));
  const wrapSelector = type === 'badge' ? '.ss-badge-wrap' : '.ss-carte-wrap';
  const frontDataUrl = await captureCardPng(container, wrapSelector + ' .art:first-child');
  const backDataUrl = await captureCardPng(container, wrapSelector + ' .art:last-child');
  return {
    student_id: student.id,
    format: type,
    front_image_base64: frontDataUrl,
    back_image_base64: backDataUrl,
    academic_year_id: state.academicYearId,
    metadata: {
      class_name: state.selectedClass.name,
      requested_at: new Date().toISOString()
    }
  };
}

async function requestPrintBatch() {
  const token = getToken();
  if (!token) {
    setStatus({ type: 'error', title: 'Connexion requise', message: 'Vous devez être connecté.', size: 'inline' });
    return;
  }
  const selected = state.students.filter(s => state.selectedStudentIds.has(s.id));
  if (selected.length === 0) {
    setStatus({ type: 'error', title: 'Sélection requise', message: 'Sélectionnez au moins un élève.', size: 'inline' });
    return;
  }

  setStatus({ type: 'loading', title: 'Génération en cours', message: `Génération de ${selected.length} carte(s)…`, size: 'inline' });
  const payloads = [];
  for (let i = 0; i < selected.length; i++) {
    try {
      const payload = await generateCardPayload(selected[i]);
      payloads.push(payload);
      setStatus({ type: 'loading', title: 'Génération en cours', message: `Génération ${i + 1}/${selected.length}…`, size: 'inline' });
    } catch (e) {
      setStatus({ type: 'error', title: 'Erreur de génération', message: `Erreur génération pour ${selected[i].first_name} ${selected[i].last_name} : ${e.message}`, size: 'inline' });
      return;
    }
  }

  setStatus({ type: 'loading', title: 'Envoi en cours', message: 'Envoi au VPS…', size: 'inline' });
  try {
    const res = await fetch(state.apiBase + '/cards/request-print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payloads)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || 'Erreur ' + res.status);
    }
    const submitted = data?.data?.filter(r => r.status === 'submitted').length || 0;
    const failed = data?.data?.filter(r => r.status === 'failed').length || 0;
    setStatus({ type: 'success', title: 'Envoi terminé', message: `Envoi terminé : ${submitted} soumis, ${failed} échec.`, size: 'inline' });
    await loadStudents(state.selectedClass.id);
  } catch (e) {
    setStatus({ type: 'error', title: 'Erreur d\'envoi', message: 'Erreur envoi : ' + e.message, size: 'inline' });
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
  const renderBtn = $('cardsRenderBtn');
  const requestBtn = $('cardsRequestPrintBtn');
  const selectAll = $('cardsSelectAll');

  if (!navCards || !studio || !closeBtn || !classSelect || !renderBtn || !requestBtn || !selectAll) {
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
    state.selectedStudentIds.clear();
    renderBtn.disabled = true;
    requestBtn.disabled = true;
    $('cardsPreview').innerHTML = window.ssState({ type: 'empty', title: 'Aucun aperçu', message: 'Sélectionnez un ou plusieurs élèves.', size: 'compact' });
    if (state.selectedClass) {
      await loadStudents(classId);
    } else {
      $('cardsStudentList').innerHTML = window.ssState({ type: 'empty', title: 'Aucune classe', message: 'Sélectionnez une classe.', size: 'compact' });
      selectAll.checked = false;
    }
  });

  selectAll.addEventListener('change', () => {
    const completeStudents = state.students.filter(s => isCardInfoComplete(s));
    if (selectAll.checked) {
      completeStudents.forEach(s => state.selectedStudentIds.add(s.id));
    } else {
      state.selectedStudentIds.clear();
    }
    renderStudentList();
  });

  renderBtn.addEventListener('click', renderPreview);
  requestBtn.addEventListener('click', requestPrintBatch);
  navCards._cardsBound = true;
}

window.SchoolSafeCards = { init: initCardsModule };
