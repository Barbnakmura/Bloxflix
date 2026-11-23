const SUPABASE_URL = "https://qxxdchsqrovyshsbhrle.supabase.co";

// COLE AQUI SUA PUBLISHABLE KEY REAL
const SUPABASE_PUBLIC_KEY = "sb_publishable_hsuNE8Uf1YdZKZqQNtxlhA_H5mGrk9A";

const BUCKET = "bloxflix-videos";

const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_PUBLIC_KEY.startsWith("sb_publishable_");

const db = supabaseConfigured
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    )
  : null;// ELEMENTOS
// ==========================================

const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const loginMessage = document.getElementById("loginMessage");
const actionMessage = document.getElementById("actionMessage");
const setupNotice = document.getElementById("setupNotice");

const logoutButton = document.getElementById("logoutButton");
const refreshButton = document.getElementById("refreshButton");

const movieForm = document.getElementById("movieForm");
const seriesForm = document.getElementById("seriesForm");
const episodeForm = document.getElementById("episodeForm");

const movieFile = document.getElementById("movieFile");
const episodeFile = document.getElementById("episodeFile");

const movieTitle = document.getElementById("movieTitle");
const movieDescription = document.getElementById("movieDescription");
const movieCover = document.getElementById("movieCover");

const seriesTitle = document.getElementById("seriesTitle");
const seriesDescription = document.getElementById("seriesDescription");
const seriesCover = document.getElementById("seriesCover");

const episodeSeries = document.getElementById("episodeSeries");
const seasonNumber = document.getElementById("seasonNumber");
const episodeNumber = document.getElementById("episodeNumber");
const episodeTitle = document.getElementById("episodeTitle");
const episodeDescription = document.getElementById("episodeDescription");

const titleList = document.getElementById("titleList");

// ==========================================
// MENSAGENS
// ==========================================

function showMessage(message, error = false) {
  if (!actionMessage) return;

  actionMessage.textContent = message;
  actionMessage.style.color = error ? "#ff5555" : "#55d98b";
}

function showLoginMessage(message) {
  if (loginMessage) {
    loginMessage.textContent = message;
  }
}

// ==========================================
// VERIFICAR CONFIGURAÇÃO
// ==========================================

if (!db) {
  if (setupNotice) {
    setupNotice.hidden = false;
    setupNotice.textContent =
      "Configure a URL e a chave pública do Supabase no admin.js.";
  }
}

// ==========================================
// LOGIN
// ==========================================

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) {
    showLoginMessage("Configure primeiro o Supabase.");
    return;
  }

  showLoginMessage("Entrando...");

  const { error } = await db.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });

  if (error) {
    showLoginMessage("Erro: " + error.message);
    return;
  }

  showLoginMessage("");
  await checkSession();
});

// ==========================================
// VERIFICAR SESSÃO
// ==========================================

async function checkSession() {
  if (!db) return;

  const { data, error } = await db.auth.getSession();

  if (error) {
    showLoginMessage(error.message);
    return;
  }

  const loggedIn = Boolean(data.session);

  loginPanel.hidden = loggedIn;
  dashboard.hidden = !loggedIn;

  if (loggedIn) {
    await loadTitles();
  }
}

// ==========================================
// SAIR
// ==========================================

logoutButton.addEventListener("click", async () => {
  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) {
    showMessage(error.message, true);
    return;
  }

  loginPanel.hidden = false;
  dashboard.hidden = true;
  showLoginMessage("Você saiu da sua conta.");
});

// ==========================================
// ABAS DO PAINEL
// ==========================================

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => {
      item.classList.remove("active");
    });

    tab.classList.add("active");

    const selected = tab.dataset.tab;

    document.querySelectorAll(
      "#movieFormPanel, #seriesFormPanel, #episodeFormPanel"
    ).forEach(panel => {
      panel.hidden = true;
    });

    const panel = document.getElementById(selected + "FormPanel");

    if (panel) {
      panel.hidden = false;
    }
  });
});

// ==========================================
// ENVIAR ARQUIVO PARA O SUPABASE
// ==========================================

async function uploadFile(file, folder) {
  if (!file) {
    throw new Error("Selecione um arquivo.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = db.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

// ==========================================
// CADASTRAR FILME
// ==========================================

movieForm.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    showMessage("Enviando filme...");

    const file = movieFile.files[0];

    if (!file) {
      throw new Error("Selecione o vídeo do filme.");
    }

    const videoUrl = await uploadFile(file, "filmes");

    const { error } = await db
      .from("titles")
      .insert({
        title: movieTitle.value.trim(),
        description: movieDescription.value.trim(),
        cover_url: movieCover.value.trim() || null,
        kind: "movie",
        video_url: videoUrl
      });

    if (error) throw error;

    movieForm.reset();

    showMessage("Filme cadastrado com sucesso!");

    await loadTitles();

  } catch (error) {
    console.error(error);
    showMessage("Erro: " + error.message, true);
  }
});

// ==========================================
// CADASTRAR SÉRIE
// ==========================================

seriesForm.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    showMessage("Cadastrando série...");

    const { error } = await db
      .from("titles")
      .insert({
        title: seriesTitle.value.trim(),
        description: seriesDescription.value.trim(),
        cover_url: seriesCover.value.trim() || null,
        kind: "series",
        video_url: null
      });

    if (error) throw error;

    seriesForm.reset();

    showMessage("Série cadastrada com sucesso!");

    await loadTitles();

  } catch (error) {
    console.error(error);
    showMessage("Erro: " + error.message, true);
  }
});

// ==========================================
// ATUALIZAR LISTA DE SÉRIES
// ==========================================

async function loadSeriesOptions(titles) {
  episodeSeries.innerHTML =
    '<option value="">Selecione uma série</option>';

  const series = titles.filter(item => item.kind === "series");

  series.forEach(item => {
    const option = document.createElement("option");

    option.value = item.id;
    option.textContent = item.title;

    episodeSeries.appendChild(option);
  });
}

// ==========================================
// CADASTRAR EPISÓDIO
// ==========================================

episodeForm.addEventListener("submit", async event => {
  event.preventDefault();

  try {
    showMessage("Enviando episódio...");

    const file = episodeFile.files[0];

    if (!file) {
      throw new Error("Selecione o vídeo do episódio.");
    }

    if (!episodeSeries.value) {
      throw new Error("Selecione uma série.");
    }

    const videoUrl = await uploadFile(file, "episodios");

    const { error } = await db
      .from("episodes")
      .insert({
        series_id: episodeSeries.value,
        season_number: Number(seasonNumber.value),
        episode_number: Number(episodeNumber.value),
        title: episodeTitle.value.trim(),
        description: episodeDescription.value.trim(),
        video_url: videoUrl
      });

    if (error) throw error;

    episodeForm.reset();

    showMessage("Episódio cadastrado com sucesso!");

  } catch (error) {
    console.error(error);
    showMessage("Erro: " + error.message, true);
  }
});

// ==========================================
// LISTAR FILMES E SÉRIES
// ==========================================

async function loadTitles() {
  if (!db) return;

  titleList.innerHTML = "<p>Carregando títulos...</p>";

  const { data, error } = await db
    .from("titles")
    .select("id,title,kind,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    titleList.textContent = "Erro: " + error.message;
    return;
  }

  titleList.innerHTML = "";

  if (!data || data.length === 0) {
    titleList.innerHTML = "<p>Nenhum título cadastrado.</p>";
  }

  data.forEach(item => {
    const container = document.createElement("div");

    container.className = "admin-title-item";

    const name = document.createElement("strong");
    name.textContent = item.title;

    const type = document.createElement("span");
    type.textContent =
      item.kind === "series" ? "Série" : "Filme";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Excluir";

    remove.addEventListener("click", () => {
      deleteTitle(item.id, item.title);
    });

    container.append(name, type, remove);
    titleList.appendChild(container);
  });

  await loadSeriesOptions(data);
}

// ==========================================
// EXCLUIR TÍTULO
// ==========================================

async function deleteTitle(id, title) {
  const confirmed = confirm(
    `Tem certeza que deseja excluir "${title}"?`
  );

  if (!confirmed) return;

  const { error } = await db
    .from("titles")
    .delete()
    .eq("id", id);

  if (error) {
    showMessage("Erro ao excluir: " + error.message, true);
    return;
  }

  showMessage("Título excluído com sucesso!");

  await loadTitles();
}

// ==========================================
// ATUALIZAR LISTA
// ==========================================

refreshButton.addEventListener("click", loadTitles);

// ==========================================
// INICIAR PAINEL
// ==========================================

if (db) {
  db.auth.onAuthStateChange(() => {
    checkSession();
  });

  checkSession();
}
