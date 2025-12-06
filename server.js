const express = require("express");
const sql = require("mssql");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static("public")); // pasta onde está o HTML

// Configuração do SQL Server
const DB_CONFIG = {
  user: "sa",
  password: "U6SjJk3ZyQhrv5tq",
  server: "DARK",
  database: "_AionWorldNew114_rc",
  options: { enableArithAbort: true, trustServerCertificate: true }
};

// 🔹 Buscar jogadores (mostra até 50 últimos logins)
app.get("/api/online", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(DB_CONFIG);
    const result = await pool.request().query(`
      SELECT TOP 50 
        char_id,
        user_id AS character_name,
        account_name,
        lev AS level,
        race,
        [class] AS class,
        last_login_time,
        last_logout_time
      FROM user_data WITH (NOLOCK)
      WHERE (delete_date IS NULL OR delete_date = 0)
      ORDER BY last_login_time DESC
    `);

    res.json({ total: result.recordset.length, players: result.recordset });
  } catch (err) {
    console.error("Erro ao buscar jogadores:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) pool.close();
  }
});

// 🔹 Enviar item via correio para todos listados
app.post("/api/sendItem", async (req, res) => {
  const { itemId, amount, title = "Evento Online", message = "Obrigado por participar do evento!" } = req.body;

  if (!itemId || !amount) return res.status(400).json({ error: "Informe itemId e amount." });

  let pool;
  try {
    pool = await sql.connect(DB_CONFIG);

    const playersResult = await pool.request().query(`
      SELECT TOP 50 char_id, user_id AS character_name
      FROM user_data WITH (NOLOCK)
      WHERE (delete_date IS NULL OR delete_date = 0)
      ORDER BY last_login_time DESC
    `);

    const players = playersResult.recordset;
    if (!players.length) return res.status(200).json({ message: "Nenhum jogador encontrado." });

    for (let p of players) {
      // Inserir item no inventário
      const itemInsert = await pool.request()
        .input("char_id", sql.Int, p.char_id)
        .input("name_id", sql.Int, itemId)
        .input("amount", sql.BigInt, amount)
        .query(`
          INSERT INTO user_item
          (char_id, name_id, slot_id, amount, slot, warehouse, create_date, update_date, producer)
          VALUES (@char_id, @name_id, 0, @amount, 0, 0, GETDATE(), GETDATE(), 'EventSystem');
          SELECT SCOPE_IDENTITY() AS id;
        `);

      const newItemId = itemInsert.recordset[0].id || itemId;

      // Enviar item via correio
      await pool.request()
        .input("to_id", sql.Int, p.char_id)
        .input("to_name", sql.NVarChar(50), p.character_name)
        .input("from_id", sql.Int, 0)
        .input("from_name", sql.NVarChar(50), "EventSystem")
        .input("title", sql.NVarChar(100), title)
        .input("content", sql.NVarChar(1000), message)
        .input("item_id", sql.BigInt, newItemId)
        .input("item_nameid", sql.Int, itemId)
        .input("item_amount", sql.BigInt, amount)
        .input("money", sql.BigInt, 0)
        .input("state", sql.TinyInt, 0)
        .input("arrive_time", sql.Int, 1)
        .input("express_mail", sql.TinyInt, 0)
        .input("item_tid", sql.BigInt, 0)
        .query(`
          INSERT INTO user_mail
          (to_id, to_name, from_id, from_name, title, content,
           item_id, item_nameid, item_amount, money, state,
           arrive_time, express_mail, item_tid)
          VALUES
          (@to_id, @to_name, @from_id, @from_name, @title, @content,
           @item_id, @item_nameid, @item_amount, @money, @state,
           @arrive_time, @express_mail, @item_tid)
        `);
    }

    res.json({ success: true, message: `✅ Item ${itemId} x${amount} enviado para ${players.length} jogadores.` });
  } catch (err) {
    console.error("Erro ao enviar item:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (pool) pool.close();
  }
});

// Iniciar servidor
const PORT = 4000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
