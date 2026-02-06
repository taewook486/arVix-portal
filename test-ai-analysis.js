// Test AI Analysis API
async function testAIAnalysis() {
  const testData = {
    title: "Test Paper: Deep Learning for Computer Vision",
    abstract: "This paper presents a novel approach to computer vision using deep learning techniques. We propose a new neural network architecture that achieves state-of-the-art results on multiple benchmarks.",
    arxivId: "2602.06043"
  };

  try {
    console.log('🧪 Testing AI Analysis API...');
    console.log('📄 Paper:', testData.title);

    const response = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ AI Analysis successful!');
      console.log('📊 Summary:', result.summary);
      console.log('🔑 Key Points:', result.keyPoints);
      console.log('📐 Methodology:', result.methodology);
      console.log('💡 Contributions:', result.contributions);
      console.log('⚠️ Limitations:', result.limitations);
      console.log('📦 Cached:', result.cached);
    } else {
      console.log('❌ AI Analysis failed!');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Request error:', error.message);
  }
}

testAIAnalysis();
