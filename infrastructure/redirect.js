function handler(event) {
  var request = event.request;
  if (request.uri === '/.well-known/jmap') {
    var host = request.headers.host && request.headers.host.value;
    // Replace apex host with jmap subdomain
    var location = 'https://jmap.' + host + '/.well-known/jmap';
    return {
      statusCode: 302,
      statusDescription: 'Found',
      headers: { location: { value: location } },
    };
  }
  return request;
}


