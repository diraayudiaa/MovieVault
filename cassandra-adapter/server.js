
const express = require('express');
const cassandra = require('cassandra-driver');

const app = express();
app.use(express.json());

const client = new cassandra.Client({
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'movievault'
});

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cek adapter
app.get('/health', (req, res) => {
    res.json({
        status: 'success',
        service: 'MovieVault Cassandra Adapter'
    });
});

// Mengambil review berdasarkan movie_id
app.get('/api/reviews/:movieId', async (req, res) => {
    const { movieId } = req.params;

    if (!uuidPattern.test(movieId)) {
        return res.status(400).json({
            status: 'error',
            message: 'Format movie_id tidak valid'
        });
    }

    try {
        const query = `
            SELECT movie_id, review_id, username,
                   rating, comment, created_at
            FROM reviews
            WHERE movie_id = ?
        `;

        const result = await client.execute(
            query,
            [cassandra.types.Uuid.fromString(movieId)],
            { prepare: true }
        );

        const reviews = result.rows.map(row => ({
            movie_id: row.movie_id.toString(),
            review_id: row.review_id.toString(),
            username: row.username,
            rating: row.rating.toString(),
            comment: row.comment,
            created_at: row.created_at
                ? row.created_at.toISOString()
                : null
        }));

        res.json({
            status: 'success',
            total: reviews.length,
            data: reviews
        });

    } catch (error) {
        console.error('Gagal mengambil review:', error.message);

        res.status(500).json({
            status: 'error',
            message: 'Gagal mengambil data review'
        });
    }
});

// Menambahkan review baru
app.post('/api/reviews/:movieId', async (req, res) => {
    const { movieId } = req.params;
    const { username, rating, comment } = req.body;

    if (!uuidPattern.test(movieId)) {
        return res.status(400).json({
            status: 'error',
            message: 'Format movie_id tidak valid'
        });
    }

    const numericRating = Number(rating);

    if (
        typeof username !== 'string' ||
        !username.trim() ||
        username.length > 100
    ) {
        return res.status(422).json({
            status: 'error',
            message: 'Username tidak valid'
        });
    }

    if (
        !Number.isFinite(numericRating) ||
        numericRating < 1 ||
        numericRating > 10
    ) {
        return res.status(422).json({
            status: 'error',
            message: 'Rating harus antara 1 sampai 10'
        });
    }

    if (
        typeof comment !== 'string' ||
        !comment.trim() ||
        comment.length > 2000
    ) {
        return res.status(422).json({
            status: 'error',
            message: 'Komentar wajib diisi dan maksimal 2000 karakter'
        });
    }

    try {
        const reviewId = cassandra.types.Uuid.random();
        const createdAt = new Date();

        const query = `
            INSERT INTO reviews (
                movie_id,
                review_id,
                username,
                rating,
                comment,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        await client.execute(
            query,
            [
                cassandra.types.Uuid.fromString(movieId),
                reviewId,
                username.trim(),
                numericRating,
                comment.trim(),
                createdAt
            ],
            { prepare: true }
        );

        res.status(201).json({
            status: 'success',
            message: 'Review berhasil ditambahkan',
            data: {
                movie_id: movieId,
                review_id: reviewId.toString(),
                username: username.trim(),
                rating: numericRating,
                comment: comment.trim(),
                created_at: createdAt.toISOString()
            }
        });

    } catch (error) {
        console.error('Gagal menyimpan review:', error.message);

        res.status(500).json({
            status: 'error',
            message: 'Gagal menyimpan review ke Cassandra'
        });
    }
});

// Jalankan server setelah koneksi Cassandra berhasil
async function startServer() {
    try {
        await client.connect();

        console.log('Berhasil terhubung ke Cassandra!');

        app.listen(3001, '127.0.0.1', () => {
            console.log('Cassandra API berjalan di http://127.0.0.1:3001');
        });

    } catch (error) {
        console.error('Gagal menjalankan adapter:', error.message);
        process.exit(1);
    }
}

startServer();

// Tutup koneksi dengan baik
async function shutdown() {
    try {
        await client.shutdown();
    } finally {
        process.exit(0);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
