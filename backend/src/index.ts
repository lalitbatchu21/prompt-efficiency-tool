export interface Env {
	eco_db: D1Database;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

		// 1. CORS Headers (Allows your Extension to talk to this)
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		// 2. Handle "Preflight" Checks
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// 3. Handle the Data Save (POST)
		if (request.method === "POST") {
			try {
				const data: any = await request.json();

				// Prepare the SQL statement
				const stmt = env.eco_db.prepare(
					`INSERT INTO eco_logs (ts, tokens, water_ml, energy_wh) VALUES (?, ?, ?, ?)`
				).bind(
					Date.now(),
					data.tokens || 0,
					data.waterMl || 0,
					data.energyWh || 0
				);

				await stmt.run();

				return new Response(JSON.stringify({ status: "logged" }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});

			} catch (err) {
				return new Response(JSON.stringify({ error: String(err) }), {
					status: 500,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}
		}

		return new Response("Method not allowed", { status: 405, headers: corsHeaders });
	},
};