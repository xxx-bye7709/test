const { OpenAI } = require('openai');

class ImageGenerator {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for ImageGenerator');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async generateImage(prompt, size = '1792x1024', quality = 'standard') {
    try {
      console.log('🎨 Generating image with prompt:', prompt.substring(0, 100));
      
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size,
        quality: quality
      });
      
      const imageUrl = response.data[0].url;
      console.log('✅ Image generated:', imageUrl);
      return imageUrl;
      
    } catch (error) {
      console.error('❌ Image generation failed:', error.message);
      return null;
    }
  }
}

module.exports = ImageGenerator;
