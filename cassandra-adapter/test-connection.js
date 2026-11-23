
const { Client } = require('cassandra-driver');

async function testConnection() {
    const client = new Client({
        contactPoints: ['127.0.0.1'],
        localDataCenter: 'datacenter1',
        keyspace: 'movievault'
    });

    try {
        await client.connect();

        console.log('Berhasil terhubung ke Cassandra!');

        const result = await client.execute(
            'SELECT movie_id, review_id, username, rating, comment, created_at FROM reviews LIMIT 10'
        );

        console.log('Jumlah review:', result.rowLength);
        console.log('Data review:');
        console.log(result.rows);

    } catch (error) {
        console.error('Koneksi gagal:', error.message);
    } finally {
        await client.shutdown();
    }
}

testConnection();
