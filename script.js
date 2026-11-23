
// BLOXFLIX PUBLICO — conecta ao MESMO projeto Supabase usado em admin.js.
// Substitua pelos mesmos valores configurados no admin.js.

const SUPABASE_URL = "https://github.com/Barbnakmura/Bloxflix2026/commit/4813a1fb31451baf18032e71a94c7793ee50f400#diff-4e5546262bd32f693179e3a007fcb1a8de8bf6b7cfe2e0a47c094b00e3b2b233";
const SUPABASE_ANON_KEY = "sb_publishable_2TMzNT1c_2Zf8ubq1CpI_w_sAZqC6gK";

const supabaseReady =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_ANON_KEY.startsWith("COLE_");

const db = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const navButtons = document.querySelectorAll(".nav-link");
const pageTitle = document.getElementById("pageTitle");
const searchInput = document.getElementById("searchInput");
const catalog = document.getElementById("catalog");
const infoDialog = document.getElementById("infoDialog");
const toast = document.getElementById("toast");
const playerDialog = document.getElementById("playerDialog");
const videoPlayer = document.getElementById("videoPlayer");
const playerTitle = document.getElementById("playerTitle");
const episodeArea = document.getElementById("episodeArea");

let allTitles = [];
let currentPage = "inicio";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(showToast.timer);

  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function escapeText(value = "") {
  return String(value).replace(/[&<>"']/g, c =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );
}

function renderCatalog() {
  const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");

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

  pageTitle.textContent = ({
    inicio: "Em destaque",
    series: "Séries",
    filmes: "Filmes",
    lista: "Minha lista"
  })[currentPage];

  catalog.className = "catalog catalog-grid";
  catalog.innerHTML = "";

  if (!db) {
    catalog.className = "catalog";
    catalog.innerHTML = `
      <div class="empty-icon">▣</div>
      <h3>Catálogo aguardando conexão</h3>
      <p>Configure a URL e a chave pública do Supabase neste arquivo e no painel administrativo.</p>
    `;
    return;
  }

  if (!items.length) {
    catalog.className = "catalog";

    catalog.innerHTML = `
      <div class="empty-icon">▣</div>
      <h3>${term ? "Nenhum resultado encontrado." : "Seu catálogo está esperando por você."}</h3>
      <p>${term
        ? "Tente pesquisar por outro título."
        : "Os filmes e séries publicados pelo painel aparecerão aqui."}</p>
    `;

    return;
  }

  items.forEach(item => {
    const card = document.createElement("button");

    card.className = "title-card";
    card.type = "button";

    card.innerHTML = `
      <div class="poster">
        ${item.cover_url
          ? `<img src="${escapeText(item.cover_url)}" alt="Capa de ${escapeText(item.title)}" loading="lazy">`
          : '<span class="poster-placeholder">B</span>'}
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

async function loadCatalog() {
  if (!db) {
    renderCatalog();
    return;
  }

  catalog.className = "catalog";

  catalog.innerHTML = `
    <div class="empty-icon">…</div>
    <h3>Carregando catálogo</h3>
    <p>Buscando os títulos publicados.</p>
  `;

  const { data, error } = await db
    .from("titles")
    .select("id,title,description,cover_url,kind,video_url")
    .order("created_at", { ascending: false });

  if (error) {
    catalog.innerHTML = `
      <div class="empty-icon">!</div>
      <h3>Não foi possível carregar</h3>
      <p>${escapeText(error.message)}</p>
    `;
    return;
  }

  allTitles = data || [];

  renderCatalog();
}

async function openTitle(item) {
  playerTitle.textContent = item.title;
  episodeArea.innerHTML = "";

  videoPlayer.pause();
  videoPlayer.removeAttribute("src");
  videoPlayer.load();

  if (item.kind === "movie") {
    if (!item.video_url) {
      showToast("Este filme ainda não tem vídeo cadastrado.");
      return;
    }

    videoPlayer.src = item.video_url;
    episodeArea.hidden = true;

  } else {
    episodeArea.hidden = false;

    const { data, error } = await db
      .from("episodes")
      .select("id,title,description,season_number,episode_number,video_url")
      .eq("series_id", item.id)
      .order("season_number")
      .order("episode_number");

    if (error) {
      showToast("Erro ao carregar episódios: " + error.message);
      return;
    }

    if (!data || !data.length) {
      episodeArea.innerHTML = `
        <p class="episode-empty">
          Esta série ainda não tem episódios publicados.
        </p>
      `;

    } else {
      const grouped = {};

      data.forEach(ep => {
        (grouped[ep.season_number] ||= []).push(ep);
      });

      Object.entries(grouped).forEach(([season, episodes]) => {
        const heading = document.createElement("h3");

        heading.className = "season-heading";
        heading.textContent = `Temporada ${season}`;

        episodeArea.appendChild(heading);

        episodes.forEach(ep => {
          const button = document.createElement("button");

          button.className = "episode-button";
          button.type = "button";
          button.textContent = `${ep.episode_number}. ${ep.title}`;

          button.addEventListener("click", () => {
            videoPlayer.src = ep.video_url;

            videoPlayer.play().catch(() => {
              showToast("Toque em reproduzir no vídeo.");
            });
          });

          episodeArea.appendChild(button);
        });
      });

      if (data[0]?.video_url) {
        videoPlayer.src = data[0].video_url;
      }
    }
  }

  playerDialog.showModal();
}

// NAVEGAÇÃO

navButtons.forEach(button => {
  button.addEventListener("click", () => {
    navButtons.forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    currentPage = button.dataset.page;
    searchInput.value = "";

    renderCatalog();
  });
});

// PESQUISA

searchInput.addEventListener("input", renderCatalog);

// BOTÕES

document.getElementById("exploreButton")
  .addEventListener("click", () => {
    document.getElementById("catalog").scrollIntoView({
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

// PLAYER

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

// INICIAR

loadCatalog();
