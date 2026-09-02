from .common import tokenize
def lexical_features(query,document):
    q,d=tokenize(query),tokenize(document); return {"overlap":sum(term in d for term in q),"query_terms":len(q),"document_terms":len(d)}
