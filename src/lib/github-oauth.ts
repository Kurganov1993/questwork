const CLIENT_ID = () => process.env.GITHUB_OAUTH_CLIENT_ID ?? '';
const CLIENT_SECRET = () => process.env.GITHUB_OAUTH_CLIENT_SECRET ?? '';

export function isGithubOAuthConfigured(): boolean {
  return !!CLIENT_ID() && !!CLIENT_SECRET();
}

export function getAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID(),
    redirect_uri: redirectUri,
    scope: 'read:user user:email repo',
    state,
    allow_signup: 'true',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      data.error_description ?? data.error ?? 'Не удалось обменять код',
    );
  }

  return data.access_token;
}

export type GithubUser = {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  email: string | null;
};

export async function fetchGithubUser(token: string): Promise<GithubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'questwork',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`GitHub user HTTP ${res.status}`);
  }

  return res.json() as Promise<GithubUser>;
}

export type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  private: boolean;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
};

export async function fetchUserRepos(token: string): Promise<GithubRepo[]> {
  const res = await fetch(
    'https://api.github.com/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'questwork',
      },
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!res.ok) {
    throw new Error(`GitHub repos HTTP ${res.status}`);
  }

  return res.json() as Promise<GithubRepo[]>;
}