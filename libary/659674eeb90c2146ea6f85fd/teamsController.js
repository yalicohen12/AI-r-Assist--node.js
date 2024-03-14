exports.getTeams = (db) => async (req, res) => {
  try {
    const getTeamsQuery = "SELECT full_name FROM teams";
    const [result] = await db.promise().query(getTeamsQuery);

    if (result.length === 0) {
      return res.status(404).json({ msg: "Teams not found" });
    }

    return res.status(200).json({ teams: result });
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
};

exports.getPlayers = (db) => async (req, res) => {
  try {
    const teamName = req.body.teamName;
    const getTeamIdQuery = "SELECT teamId FROM teams WHERE full_name = ?";
    const [teamIdResult] = await db.promise().query(getTeamIdQuery, [teamName]);

    if (teamIdResult.length === 0) {
      return res.status(404).json({ error: "Team not found" });
    }

    const teamId = teamIdResult[0].teamId;

    const getPlayersQuery = `
        SELECT playerId, 
               first_name, last_name, position, jersey
        FROM players
        WHERE players.teamId = ?
        GROUP BY playerId
      `;

    const [playersResult] = await db.promise().query(getPlayersQuery, [teamId]);

    const parsedPlayersResult = playersResult.map((player) => {
      return {
        playerId: player.playerId,
        first_name: player.first_name,
        last_name: player.last_name,
        position: player.position,
        jersey: player.jersey,
        playerImage: `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${player.playerId}.png`,
      };
    });

    return res.status(200).json({players:parsedPlayersResult});
  } catch (error) {
    console.error("Error fetching players:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
