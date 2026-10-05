const { createApp, ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } = Vue;

const STORAGE_KEY = 'para-hoy:tasks:v1';

// Fechas en local, formato YYYY-MM-DD (comparables como texto)
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const loadTasks = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
};

const isSafeUrl = u => {
  try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; }
};

createApp({
  setup() {
    const tasks = ref(loadTasks());
    const today = ref(toISO(new Date()));
    const showLater = ref(false);
    const open = ref(false);
    const textInput = ref(null);

    const form = reactive({ text: '', note: '', link: '', date: today.value, importance: 2 });
    const levels = [
      { value: 1, label: 'Baja' },
      { value: 2, label: 'Normal' },
      { value: 3, label: 'Alta' },
    ];

    watch(tasks, v => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch {}
    }, { deep: true });

    // Si la pestaña queda abierta de un día para otro
    const refreshToday = () => {
      const now = toISO(new Date());
      if (now !== today.value) {
        if (form.date === today.value) form.date = now;
        today.value = now;
      }
    };
    onMounted(() => document.addEventListener('visibilitychange', refreshToday));
    onUnmounted(() => document.removeEventListener('visibilitychange', refreshToday));

    const openForm = () => {
      if (form.date < today.value) form.date = today.value;
      open.value = true;
      nextTick(() => textInput.value?.focus());
    };
    const closeForm = () => { open.value = false; };

    const onKey = e => {
      if (e.key === 'Escape' && open.value) return closeForm();
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if (e.key.toLowerCase() === 'n' && !typing && !open.value && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openForm();
      }
    };
    onMounted(() => document.addEventListener('keydown', onKey));
    onUnmounted(() => document.removeEventListener('keydown', onKey));

    const tomorrow = computed(() => toISO(addDays(fromISO(today.value), 1)));

    // Viernes de la semana laboral en curso (si es fin de semana, el siguiente)
    const friday = computed(() => {
      const d = fromISO(today.value);
      return toISO(addDays(d, (5 - d.getDay() + 7) % 7));
    });

    const sorted = list => [...list].sort((a, b) =>
      a.done - b.done || b.importance - a.importance || a.date.localeCompare(b.date));

    const hoy = computed(() => sorted(tasks.value.filter(t =>
      t.date === today.value || (t.date < today.value && !t.done))));
    const manana = computed(() => sorted(tasks.value.filter(t => t.date === tomorrow.value)));
    const semana = computed(() => sorted(tasks.value.filter(t =>
      t.date > tomorrow.value && t.date <= friday.value && t.importance === 3)));
    const later = computed(() => {
      const shown = new Set([...hoy.value, ...manana.value, ...semana.value].map(t => t.id));
      return sorted(tasks.value.filter(t => !shown.has(t.id) && t.date > today.value))
        .sort((a, b) => a.date.localeCompare(b.date));
    });

    const sections = computed(() => [
      { key: 'hoy', title: 'Hoy', items: hoy.value, empty: 'Nada pendiente para hoy.' },
      { key: 'manana', title: 'Mañana', items: manana.value, empty: 'Nada apuntado para mañana.' },
      { key: 'semana', title: 'Importantes de esta semana', items: semana.value, showDate: true,
        empty: 'Sin tareas importantes el resto de la semana.' },
    ]);

    const doneCount = computed(() => tasks.value.filter(t => t.done).length);

    const todayLabel = computed(() =>
      fromISO(today.value).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    const shortDate = iso =>
      fromISO(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

    const addTask = () => {
      if (!form.text || !form.date) return;
      tasks.value.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text: form.text,
        note: form.note,
        link: isSafeUrl(form.link) ? form.link : '',
        date: form.date,
        importance: form.importance,
        done: false,
      });
      form.text = '';
      form.note = '';
      form.link = '';
      closeForm();
    };

    const toggle = t => { t.done = !t.done; };
    const remove = t => { tasks.value = tasks.value.filter(x => x.id !== t.id); };
    const clearDone = () => { tasks.value = tasks.value.filter(t => !t.done); };

    return {
      tasks, today, form, open, openForm, closeForm, levels, sections, later, showLater, doneCount, textInput,
      todayLabel, shortDate, addTask, toggle, remove, clearDone,
    };
  },
}).mount('#app');