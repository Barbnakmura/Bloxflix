
// ==========================================
// BLOXFLIX — CATÁLOGO PÚBLICO
// Integração com o painel administrativo
// ==========================================

// Use os mesmos dados do projeto Supabase
// que você colocou no admin.js.

const SUPABASE_URL = "https://github.com/Barbnakmura/Bloxflix2026/commit/4813a1fb31451baf18032e71a94c7793ee50f400#diff-4e5546262bd32f693179e3a007fcb1";
const SUPABASE_PUBLIC_KEY = "sb_publishable_2TMzNT1c_2Zf8ubq1CpI_w_sAZqC6gK";

const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_PUBLIC_KEY.startsWith("COLE_");

const db = supabaseConfigured
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    )
  : null;

// Elementos do site
const catalog = document.getElementById("catalog");
const pageTitle = document.getElementById("pageTitle");
const searchInput = document.getElementById("searchInput");

const playerDialog = document.getElementById("playerDialog");
const videoPlayer = document.getElementById("videoPlayer");
const playerTitle = document.getElementById("playerTitle");
const episodeArea = document.getElementById("episodeArea");

const infoDialog = document.getElementById("infoDialog");
const toast = document.getElementById("toast");

let allTitles = [];
let currentPage = "inicio";

// ==========================================
// AVISOS
// ==========================================

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

// ==========================================
// SEGURANÇA DE TEXTO
// ==========================================

function escapeText(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// ==========================================
// CARREGAR CATÁLOGO
// ==========================================

async function loadCatalog() {
  if (!db) {
    catalog.innerHTML = `
      <div class="empty-icon">!</div>
      <h3>Conexão não configurada</h3>
      <p>Configure a URL e a chave pública do Supabase no script.js.</p>
    `;
    return;
  }

  catalog.innerHTML = `
    <div class="empty-icon">…</div>
    <h3>Carregando Bloxflix</h3>
    <p>Estamos buscando os filmes e séries.</p>
  `;

  const { data, error } = await db
    .from("titles")
    .select("id,title,description,cover_url,kind,video_url")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar títulos:", error);

    catalog.innerHTML = `
      <div class="empty-icon">!</div>
      <h3>Erro ao carregar o catálogo</h3>
      <p>${escapeText(error.message)}</p>
    `;

    return;
  }

  allTitles = data || [];
  renderCatalog();
}

// ==========================================
// EXIBIR FILMES E SÉRIES
// ==========================================

function renderCatalog() {
  const term = searchInput.value
    .trim()
    .toLocaleLowerCase("pt-BR");

  let items = allTitles.filter(item => {
    const matchesPage =
      currentPage === "inicio" ||
      currentPage === "lista" ||
      (currentPage === "series" && item.kind === "series") ||
      (currentPage === "filmes" && item.kind === "movie");

    const matchesSearch =
      !term ||
      `${item.title} ${item.description || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(term);

    return matchesPage && matchesSearch;
  });

  pageTitle.textContent = {
    inicio: "Em destaque",
    series: "Séries",
    filmes: "Filmes",
    lista: "Minha lista"
  }[currentPage];

  catalog.className = "catalog catalog-grid";
  catalog.innerHTML = "";

  if (!items.length) {
    catalog.className = "catalog";

    catalog.innerHTML = `
      <div class="empty-icon">▣</div>
      <h3>${term ? "Nenhum resultado encontrado." : "Seu catálogo está esperando por você."}</h3>
      <p>${term
        ? "Tente pesquisar outro título."
        : "Os filmes e séries cadastrados no painel aparecerão aqui."}</p>
    `;

    return;
  }

  items.forEach(item => {
    const card = document.createElement("button");

    card.className = "title-card";
    card.type = "button";

    card.innerHTML = `
      <div class="poster">
        ${
          item.cover_url
            ? `<img src="${escapeText(item.cover_url)}"
                alt="Capa de ${escapeText(item.title)}"
                loading="lazy">`
            : '<span class="poster-placeholder">B</span>'
        }
      </div>

      <div class="card-copy">
        <strong>${escapeText(item.title)}</strong>
        <small>${item.kind === "series" ? "Série" : "Filme"}</small>
      </div>
    `;

    card.addEventListener("click", () => openTitle(item));

    catalog.appendChild(card);
  });
}

// ==========================================
// ABRIR FILME OU SÉRIE
// ==========================================

async function openTitle(item) {
  playerTitle.textContent = item.title;
  episodeArea.innerHTML = "";

  videoPlayer.pause();
  videoPlayer.removeAttribute("src");
  videoPlayer.load();

  if (item.kind === "movie") {
    episodeArea.hidden = true;

    if (!item.video_url) {
      showToast("Este filme ainda não possui vídeo.");
      return;
    }

    videoPlayer.src = item.video_url;

  } else {
    episodeArea.hidden = false;

    const { data, error } = await db
      .from("episodes")
      .select(`
        id,
        title,
        description,
        season_number,
        episode_number,
        video_url
      `)
      .eq("series_id", item.id)
      .order("season_number")
      .order("episode_number");

    if (error) {
      showToast("Erro ao carregar os episódios.");
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      episodeArea.innerHTML = `
        <p class="episode-empty">
          Esta série ainda não possui episódios cadastrados.
        </p>
      `;
    } else {
      const grouped = {};

      data.forEach(episode => {
        const season = episode.season_number || 1;

        if (!grouped[season]) {
          grouped[season] = [];
        }

        grouped[season].push(episode);
      });

      Object.entries(grouped).forEach(([season, episodes]) => {
        const heading = document.createElement("h3");

        heading.className = "season-heading";
        heading.textContent = `Temporada ${season}`;

        episodeArea.appendChild(heading);

        episodes.forEach(episode => {
          const button = document.createElement("button");

          button.className = "episode-button";
          button.type = "button";

          button.textContent =
            `${episode.episode_number}. ${episode.title}`;

          button.addEventListener("click", () => {
            if (!episode.video_url) {
              showToast("Este episódio ainda não possui vídeo.");
              return;
            }

            videoPlayer.src = episode.video_url;
            videoPlayer.play().catch(() => {
              showToast("Toque no botão de reprodução do vídeo.");
            });
          });

          episodeArea.appendChild(button);
        });
      });
    }
  }

  playerDialog.showModal();
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    currentPage = button.dataset.page;
    searchInput.value = "";

    renderCatalog();
  });
});

// ==========================================
// PESQUISA
// ==========================================

searchInput.addEventListener("input", renderCatalog);

// ==========================================
// BOTÕES
// ==========================================

document.getElementById("exploreButton")
  .addEventListener("click", () => {
    catalog.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });

document.getElementById("aboutButton")
  .addEventListener("click", () => {
    infoDialog.showModal();
  });

document.getElementById("closeDialog")
  .addEventListener("click", () => {
    infoDialog.close();
  });

document.getElementById("dialogOk")
  .addEventListener("click", () => {
    infoDialog.close();
  });

document.getElementById("profileButton")
  .addEventListener("click", () => {
    showToast("Perfil principal — Bloxflix");
  });

// ==========================================
// PLAYER
// ==========================================

document.getElementById("closePlayer")
  .addEventListener("click", () => {
    videoPlayer.pause();
    playerDialog.close();
  });

playerDialog.addEventListener("close", () => {
  videoPlayer.pause();
  videoPlayer.removeAttribute("src");
  videoPlayer.load();
});

// ==========================================
// INICIAR
// ==========================================

loadCatalog();
