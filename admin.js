
// Configure estes dados depois de criar o projeto Supabase.
const SUPABASE_URL = "COLE_A_URL_DO_SEU_PROJETO";
const SUPABASE_ANON_KEY = "COLE_A_CHAVE_PUBLICA_ANON";
const STORAGE_BUCKET = "bloxflix-videos";

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_ANON_KEY.startsWith("COLE_");

const client = configured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = id => document.getElementById(id);
const loginPanel = $("loginPanel");
const dashboard = $("dashboard");
const loginMessage = $("loginMessage");
const actionMessage = $("actionMessage");

if (!configured) {
  $("setupNotice").classList.add("needs-setup");

  loginMessage.textContent =
    "Painel visual pronto. Falta conectar o Supabase para ativar login, banco de dados e upload.";

  $("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    loginMessage.textContent =
      "Antes do login, precisamos configurar o Supabase. Não compartilhe sua senha com ninguém.";
  });
} else {
  $("setupNotice").hidden = true;

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    loginMessage.textContent = "Entrando...";

    const { error } = await client.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    loginMessage.textContent = error ? error.message : "";

    if (!error) await showDashboard();
  });

  client.auth.getSession().then(({ data }) => {
    if (data.session) showDashboard();
  });
}

async function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  await loadSeries();
  await loadTitles();
}

$("logoutButton").addEventListener("click", async () => {
  if (client) await client.auth.signOut();

  dashboard.hidden = true;
  loginPanel.hidden = false;
});

$("refreshButton").addEventListener("click", loadTitles);

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => {
      b.classList.toggle("active", b === btn);
    });

    ["movie", "series", "episode"].forEach(key => {
      $(key + "FormPanel").hidden = key !== btn.dataset.tab;
    });
  });
});

async function uploadVideo(file, folder) {
  if (!file) throw new Error("Escolha um arquivo de vídeo.");

  const allowed = [
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ];

  if (!allowed.includes(file.type)) {
    throw new Error("Use um vídeo MP4, WebM ou MOV.");
  }

  const safeName = file.name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-");

  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw error;

  const { data } = client.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return {
    path,
    url: data.publicUrl
  };
}

function setBusy(form, busy) {
  form.querySelector('button[type="submit"]').disabled = busy;
}

async function runForm(form, task) {
  actionMessage.textContent =
    "Processando... não feche esta página.";

  setBusy(form, true);

  try {
    await task();

    actionMessage.textContent = "Publicado com sucesso!";

    form.reset();

    await loadSeries();
    await loadTitles();

  } catch (err) {
    actionMessage.textContent =
      "Não foi possível concluir: " +
      (err.message || "erro inesperado");

  } finally {
    setBusy(form, false);
  }
}

// CADASTRO DE FILMES

$("movieForm").addEventListener("submit", e => {
  e.preventDefault();

  runForm(e.currentTarget, async () => {
    const file = $("movieFile").files[0];

    const uploaded = await uploadVideo(file, "movies");

    const { error } = await client.from("titles").insert({
      title: $("movieTitle").value.trim(),
      description: $("movieDescription").value.trim(),
      cover_url: $("movieCover").value.trim() || null,
      kind: "movie",
      video_path: uploaded.path,
      video_url: uploaded.url
    });

    if (error) throw error;
  });
});

// CADASTRO DE SÉRIES

$("seriesForm").addEventListener("submit", e => {
  e.preventDefault();

  runForm(e.currentTarget, async () => {
    const { error } = await client.from("titles").insert({
      title: $("seriesTitle").value.trim(),
      description: $("seriesDescription").value.trim(),
      cover_url: $("seriesCover").value.trim() || null,
      kind: "series"
    });

    if (error) throw error;
  });
});

// CADASTRO DE EPISÓDIOS

$("episodeForm").addEventListener("submit", e => {
  e.preventDefault();

  runForm(e.currentTarget, async () => {
    const uploaded = await uploadVideo(
      $("episodeFile").files[0],
      "episodes"
    );

    const { error } = await client.from("episodes").insert({
      series_id: $("episodeSeries").value,
      season_number: Number($("seasonNumber").value),
      episode_number: Number($("episodeNumber").value),
      title: $("episodeTitle").value.trim(),
      description: $("episodeDescription").value.trim(),
      video_path: uploaded.path,
      video_url: uploaded.url
    });

    if (error) throw error;
  });
});

// CARREGAR SÉRIES

async function loadSeries() {
  if (!client) return;

  const { data, error } = await client
    .from("titles")
    .select("id,title")
    .eq("kind", "series")
    .order("title");

  const select = $("episodeSeries");
  select.innerHTML = "";

  if (error) {
    select.innerHTML =
      '<option value="">Erro ao carregar séries</option>';
    return;
  }

  if (!data.length) {
    select.innerHTML =
      '<option value="">Cadastre uma série primeiro</option>';
    return;
  }

  data.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.title;
    select.appendChild(opt);
  });
}

// CARREGAR CATÁLOGO

async function loadTitles() {
  if (!client) {
    $("titleList").innerHTML =
      '<p class="empty">Conecte o Supabase para carregar os títulos.</p>';
    return;
  }

  const { data, error } = await client
    .from("titles")
    .select("id,title,kind,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    $("titleList").textContent = error.message;
    return;
  }

  $("titleList").innerHTML = "";

  if (!data.length) {
    $("titleList").innerHTML =
      '<p class="empty">Nenhum título cadastrado ainda.</p>';
    return;
  }

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "title-item";

    const strong = document.createElement("strong");
    strong.textContent = item.title;

    const small = document.createElement("small");
    small.textContent =
      item.kind === "series" ? "Série" : "Filme";

    div.append(strong, small);
    $("titleList").appendChild(div);
  });
}
